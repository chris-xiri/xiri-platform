
"use client";

import { Vendor } from "@xiri/shared";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Eye, Briefcase, Zap } from "lucide-react";
import Link from "next/link";
import { getStatusColor, getScoreColor } from "./utils";

interface VendorRowProps {
    vendor: Vendor;
    index: number;
    showActions: boolean;
    isRecruitmentMode?: boolean;
    onUpdateStatus: (id: string, newStatus: Vendor['status'], options?: { onboardingTrack?: 'FAST_TRACK' | 'STANDARD', hasActiveContract?: boolean }) => void;
    onSelect?: (id: string) => void;
    isActive?: boolean;
}

export function VendorRow({ vendor, index, showActions, isRecruitmentMode = false, onUpdateStatus, onSelect, isActive }: VendorRowProps) {
    const isGrayedOut = isRecruitmentMode && (vendor.status || 'pending_review').toLowerCase() !== 'pending_review';

    // Helper to parse legacy address strings
    const parseLegacyAddress = (addr: string | undefined) => {
        if (!addr) return { city: '-', state: '-', zip: '-' };

        // Try to match "City, ST Zip" pattern
        // Matches: "New York, NY 10001" or "New York, NY 10001, USA"
        const stateZipRegex = /([A-Za-z\s]+)[,]\s+([A-Z]{2})\s+(\d{5})/;
        const match = addr.match(stateZipRegex);

        if (match) {
            return {
                city: match[1].trim(),
                state: match[2],
                zip: match[3]
            };
        }

        // Fallback: Naive comma split
        const parts = addr.split(',');
        if (parts.length >= 2) {
            // Assume last part is "ST Zip"
            const lastPart = parts[parts.length - 1].trim();
            const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5})/);
            if (stateZipMatch) {
                return {
                    city: parts[parts.length - 2].trim(),
                    state: stateZipMatch[1],
                    zip: stateZipMatch[2]
                };
            }
        }

        return { city: addr, state: '-', zip: '-' };
    };

    const location = {
        city: vendor.city || parseLegacyAddress(vendor.address).city,
        state: vendor.state || parseLegacyAddress(vendor.address).state,
        zip: vendor.zip || parseLegacyAddress(vendor.address).zip
    };

    // Determine Link Destination based on Mode
    const detailLink = isRecruitmentMode
        ? `/supply/recruitment/${vendor.id}`
        : `/supply/crm/${vendor.id}`;

    const handleRowClick = (e: React.MouseEvent) => {
        if (onSelect) {
            e.preventDefault();
            e.stopPropagation();
            if (vendor.id) onSelect(vendor.id);
        }
    };

    return (
        <TableRow
            className={`transition-colors border-b border-border text-foreground 
                ${isGrayedOut ? 'opacity-50 grayscale' : ''} 
                ${isActive ? 'bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary' : 'hover:bg-muted/50'}
            `}
        >
            <TableCell className="font-medium py-2">{index + 1}</TableCell>
            <TableCell className="py-2">
                <Link href={detailLink} onClick={handleRowClick} className="block group cursor-pointer">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            {vendor.preferredLanguage === 'es' ? (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 px-1 py-0 h-4 text-[9px]">ES</Badge>
                            ) : null}
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{vendor.businessName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {vendor.contactName || vendor.email || "No contact info"}
                        </span>
                    </div>
                </Link>
            </TableCell>
            <TableCell className="text-center">
                <span className="text-sm font-medium">
                    {location.city}
                </span>
            </TableCell>
            <TableCell className="text-center">
                <span className="text-sm font-medium">
                    {location.state}
                </span>
            </TableCell>
            <TableCell className="text-center">
                <span className="text-xs text-muted-foreground font-mono">
                    {location.zip}
                </span>
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
                            vendor.status === 'onboarding_scheduled' ? 'Onboarding' :
                                vendor.status === 'ready_for_assignment' ? 'Ready' :
                                    vendor.status.replace('_', ' ')}
                </Badge>
            </TableCell>
            <TableCell className="text-right py-2">
                {isGrayedOut ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-slate-300">
                        Already in CRM
                    </Badge>
                ) : showActions && (
                    <div className="flex justify-center gap-1.5">
                        {(vendor.status || 'pending_review').toLowerCase() === 'pending_review' ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'qualified', { onboardingTrack: 'STANDARD', hasActiveContract: false })}
                                    className="h-7 px-2 border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white transition-all font-medium text-xs"
                                    title="Standard Network Invite"
                                >
                                    <Check className="w-3 h-3 mr-1" /> Standard
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'qualified', { onboardingTrack: 'FAST_TRACK', hasActiveContract: true })}
                                    className="h-7 px-2 border-purple-200 text-purple-700 hover:bg-purple-600 hover:text-white transition-all font-medium text-xs"
                                    title="Urgent Contract Invite"
                                >
                                    <Zap className="w-3 h-3 mr-1" /> Urgent
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'rejected')}
                                    className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all font-medium text-xs"
                                    title="Reject Vendor"
                                >
                                    <X className="w-3 h-3" />
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
