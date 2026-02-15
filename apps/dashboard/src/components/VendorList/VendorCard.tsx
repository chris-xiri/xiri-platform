
"use client";

import { Vendor } from "@xiri/shared";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getStatusColor, getScoreColor } from "./utils";

interface VendorCardProps {
    vendor: Vendor;
    index: number;
    isRecruitmentMode?: boolean;
}

export function VendorCard({ vendor, index, isRecruitmentMode = false }: VendorCardProps) {
    return (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-card shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex-1 flex gap-2">
                    <span className="text-muted-foreground font-medium text-xs mt-0.5">#{index + 1}</span>
                    <div>
                        <Link href={isRecruitmentMode ? `/supply/recruitment/${vendor.id}` : `/supply/crm/${vendor.id}`} className="hover:opacity-80 transition-opacity">
                            <h3 className="font-medium text-foreground hover:text-primary transition-colors">{vendor.businessName}</h3>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{vendor.address}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                    <Badge className={getStatusColor(vendor.status, vendor.outreachStatus)}>
                        {vendor.status === 'pending_review' ? 'Review Needed' :
                            vendor.status === 'compliance_review' ? 'Compliance' :
                                vendor.status === 'onboarding_scheduled' ? 'Onboarding' :
                                    vendor.status === 'ready_for_assignment' ? 'Ready' :
                                        vendor.status.replace('_', ' ')}
                    </Badge>
                </div>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                <div className="flex items-center gap-2">
                    {!isRecruitmentMode && (
                        vendor.preferredLanguage === 'es' ? (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 px-1.5 h-5 text-[10px]">ES</Badge>
                        ) : (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 px-1.5 h-5 text-[10px]">EN</Badge>
                        )
                    )}
                    <span className={`text-xs font-medium ${getScoreColor(vendor.fitScore)}`}>
                        Score: {vendor.fitScore || "N/A"}
                    </span>
                </div>
            </div>
        </div>
    );
}
