'use client';

import { Vendor } from '@xiri/shared';
import { Briefcase } from 'lucide-react';

interface VendorAssignmentsProps {
    vendor: Vendor;
}

export default function VendorAssignments({ vendor }: VendorAssignmentsProps) {
    // Determine active contract status from vendor record or mock data
    // In a real implementation, we would fetch Jobs where vendorId == vendor.id

    // Mock Data removed as requested
    const activeJobs: any[] = [];

    return (
        <div className="py-12 text-center border-dashed border-2 border-muted rounded-lg bg-muted/5">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground">No Assignment Data</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1 mb-4">
                Assignment details and job tracking history will appear here once connected to the Work Order system.
            </p>
        </div>
    );
}
