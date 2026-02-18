'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, Eye, Loader2, ChevronDown, ChevronUp, ExternalLink, Phone, Globe, MapPin } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor } from '@xiri/shared';

interface CampaignResultsTableProps {
    vendors: Vendor[];
    campaignMeta?: { query: string; location: string; sourced: number; qualified: number };
    onApprove: (vendorId: string) => void;
    onDismiss: (vendorId: string) => void;
    onApproveAll: () => void;
    onDismissAll: () => void;
}

export default function CampaignResultsTable({
    vendors,
    campaignMeta,
    onApprove,
    onDismiss,
    onApproveAll,
    onDismissAll
}: CampaignResultsTableProps) {
    const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);
    const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
    const [showBulkDismissDialog, setShowBulkDismissDialog] = useState(false);

    if (vendors.length === 0) return null;

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedVendors(new Set(vendors.map(v => v.id!)));
        } else {
            setSelectedVendors(new Set());
        }
    };

    const handleSelectVendor = (vendorId: string, checked: boolean) => {
        const newSelected = new Set(selectedVendors);
        if (checked) {
            newSelected.add(vendorId);
        } else {
            newSelected.delete(vendorId);
        }
        setSelectedVendors(newSelected);
    };

    const handleBulkApprove = () => {
        selectedVendors.forEach(id => onApprove(id));
        setSelectedVendors(new Set());
        setShowBulkApproveDialog(false);
    };

    const handleBulkDismiss = () => {
        selectedVendors.forEach(id => onDismiss(id));
        setSelectedVendors(new Set());
        setShowBulkDismissDialog(false);
    };

    const allSelected = vendors.length > 0 && selectedVendors.size === vendors.length;

    const getScoreColor = (score?: number) => {
        if (!score) return 'text-muted-foreground';
        if (score >= 80) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-500';
    };

    return (
        <Card className="border-2 border-dashed border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm mb-4">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        Campaign Preview
                    </span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">
                        {vendors.length} results
                    </Badge>
                    {campaignMeta && (
                        <span className="text-xs text-muted-foreground hidden md:inline">
                            "{campaignMeta.query}" in {campaignMeta.location}
                        </span>
                    )}
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">
                        Not saved — preview only
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            {expanded && (
                <CardContent className="p-0">
                    {/* Bulk Action Bar */}
                    <div className="px-4 py-2 border-y border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {selectedVendors.size > 0 ? (
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                    {selectedVendors.size} selected
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    Select vendors to approve or dismiss
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedVendors.size > 0 ? (
                                <>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => setShowBulkApproveDialog(true)}
                                    >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Approve ({selectedVendors.size})
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setShowBulkDismissDialog(true)}
                                    >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Dismiss ({selectedVendors.size})
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                        onClick={onApproveAll}
                                    >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Approve All
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={onDismissAll}
                                    >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Dismiss All
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full caption-bottom text-sm">
                            <TableHeader className="bg-blue-50/80 dark:bg-blue-950/40">
                                <TableRow className="border-b border-blue-200/50 dark:border-blue-800/50">
                                    <TableHead className="h-8 w-10 text-center">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={handleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead className="h-8 text-xs font-semibold w-8 text-center">#</TableHead>
                                    <TableHead className="h-8 text-xs font-semibold">Vendor</TableHead>
                                    <TableHead className="h-8 text-xs font-semibold">Location</TableHead>
                                    <TableHead className="h-8 text-xs font-semibold text-center">AI Score</TableHead>
                                    <TableHead className="h-8 text-xs font-semibold">Capabilities</TableHead>
                                    <TableHead className="h-8 text-xs font-semibold text-center">Contact</TableHead>
                                    <TableHead className="h-8 text-xs font-semibold text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vendors.map((vendor, index) => (
                                    <TableRow
                                        key={vendor.id || index}
                                        className="border-b border-blue-100/50 dark:border-blue-900/30 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                                    >
                                        <TableCell className="text-center py-2">
                                            <Checkbox
                                                checked={selectedVendors.has(vendor.id!)}
                                                onCheckedChange={(checked: boolean) => handleSelectVendor(vendor.id!, checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground py-2">
                                            {index + 1}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm truncate max-w-[200px]">
                                                    {vendor.businessName}
                                                </span>
                                                {vendor.website && (
                                                    <a
                                                        href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5"
                                                    >
                                                        <Globe className="w-3 h-3" />
                                                        website
                                                    </a>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate max-w-[180px]">
                                                    {vendor.city && vendor.state
                                                        ? `${vendor.city}, ${vendor.state}`
                                                        : vendor.address || 'N/A'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-2">
                                            <span className={`text-sm font-bold ${getScoreColor(vendor.fitScore)}`}>
                                                {vendor.fitScore || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex flex-wrap gap-1">
                                                {(vendor.capabilities || []).slice(0, 2).map((cap, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                                        {cap}
                                                    </Badge>
                                                ))}
                                                {(vendor.capabilities || []).length > 2 && (
                                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                        +{(vendor.capabilities || []).length - 2}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                {vendor.phone && (
                                                    <a href={`tel:${vendor.phone}`} className="text-muted-foreground hover:text-foreground" title={vendor.phone}>
                                                        <Phone className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {vendor.website && (
                                                    <a
                                                        href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        title="Visit website"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {!vendor.phone && !vendor.website && (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => onApprove(vendor.id!)}
                                                    title="Approve into CRM"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => onDismiss(vendor.id!)}
                                                    title="Dismiss"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-3 space-y-2">
                        {vendors.map((vendor, index) => (
                            <div
                                key={vendor.id || index}
                                className="border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3 bg-white dark:bg-card"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="font-medium text-sm">{vendor.businessName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {vendor.city && vendor.state
                                                ? `${vendor.city}, ${vendor.state}`
                                                : vendor.address || 'N/A'}
                                        </p>
                                    </div>
                                    <span className={`text-sm font-bold ${getScoreColor(vendor.fitScore)}`}>
                                        {vendor.fitScore || '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => onApprove(vendor.id!)}
                                    >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="flex-1 h-8 text-xs text-red-600"
                                        onClick={() => onDismiss(vendor.id!)}
                                    >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            )}

            {/* Bulk Approve Dialog */}
            <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve {selectedVendors.size} Vendor{selectedVendors.size > 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will save {selectedVendors.size} vendor{selectedVendors.size > 1 ? 's' : ''} to the CRM pipeline with "pending_review" status.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700 text-white">
                            Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Dismiss Dialog */}
            <AlertDialog open={showBulkDismissDialog} onOpenChange={setShowBulkDismissDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dismiss {selectedVendors.size} Vendor{selectedVendors.size > 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove {selectedVendors.size} vendor{selectedVendors.size > 1 ? 's' : ''} from the preview. This data will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDismiss} className="bg-red-600 hover:bg-red-700 text-white">
                            Dismiss
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
