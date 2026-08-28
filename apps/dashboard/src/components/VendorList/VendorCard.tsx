
"use client";

import { Vendor } from "@xiri-facility-solutions/shared";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { getStatusColor, getScoreColor, getInsuranceStatusInfo, getVendorInsuranceDocs } from "./utils";
import { FileText, ExternalLink } from "lucide-react";

interface VendorCardProps {
    vendor: Vendor;
    index: number;
    isRecruitmentMode?: boolean;
    isSelected?: boolean;
    onSelectChange?: (checked: boolean) => void;
}

export function VendorCard({ vendor, index, isRecruitmentMode = false, isSelected, onSelectChange }: VendorCardProps) {
    const insuranceInfo = getInsuranceStatusInfo(vendor);
    const insuranceDocs = getVendorInsuranceDocs(vendor);

    return (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-card shadow-sm">
            <div className="flex items-start justify-between">
                <div className="flex-1 flex gap-2">
                    {onSelectChange && (
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={onSelectChange}
                            aria-label="Select vendor"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className="mt-1"
                        />
                    )}
                    <span className="text-muted-foreground font-medium text-xs mt-0.5">#{index + 1}</span>
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {insuranceInfo.isBlocked ? (
                                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 px-1 py-0 h-4 text-[9px] font-bold">
                                    ⛔ Blocked
                                </Badge>
                            ) : insuranceInfo.isExpired ? (
                                <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 px-1 py-0 h-4 text-[9px] font-bold" title="Insurance policy has expired. Upload updated policy to restore Fully Insured status.">
                                    ⚠️ Expired Policy
                                </Badge>
                            ) : insuranceInfo.isFullyInsured ? (
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 px-1 py-0 h-4 text-[9px] font-bold">
                                    🛡️ Fully Insured
                                </Badge>
                            ) : null}
                            {insuranceDocs.length > 0 && (
                                <a
                                    href={insuranceDocs[0].url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 h-4 rounded text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                                    title={`View ${insuranceDocs[0].title}`}
                                >
                                    <FileText className="w-2.5 h-2.5" />
                                    COI PDF
                                    <ExternalLink className="w-2 h-2 opacity-80" />
                                </a>
                            )}
                        </div>
                        <Link href={isRecruitmentMode ? `/supply/recruitment/${vendor.id}` : `/supply/crm/${vendor.id}`} className="hover:opacity-80 transition-opacity">
                            <h3 className="font-medium text-foreground hover:text-primary transition-colors">{vendor.businessName}</h3>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{vendor.address}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono select-all">ID: {vendor.id}</p>
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
