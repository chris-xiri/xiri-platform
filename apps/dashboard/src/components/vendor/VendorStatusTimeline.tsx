'use client';

import React, { useState } from 'react';
import { Vendor } from '@xiri/shared';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Linear progression of happy-path statuses
const STATUS_STEPS = [
    { id: 'pending_review', label: 'Review Needed', description: 'Initial application review' },
    { id: 'qualified', label: 'Qualified', description: 'Vendor meets basic criteria' },
    { id: 'compliance_review', label: 'Compliance', description: 'Insurance & doc verification' },
    { id: 'onboarding_scheduled', label: 'Onboarding', description: 'Orientation call scheduled' },
    { id: 'ready_for_assignment', label: 'Ready', description: 'Approved for work orders' },
    { id: 'active', label: 'Active', description: 'Currently servicing contracts' }
];

interface VendorStatusTimelineProps {
    status: Vendor['status'];
}

export default function VendorStatusTimeline({ status }: VendorStatusTimelineProps) {
    // Auto-collapse if active to save space
    const [isOpen, setIsOpen] = useState(status !== 'active');

    // Determine current step index
    let currentIndex = STATUS_STEPS.findIndex(s => s.id === status);

    // Handle terminal/error states
    const isRejected = status === 'rejected';
    const isSuspended = status === 'suspended';

    // If status is not in the happy path (e.g. rejected), we might want to just show that state
    // But user wants a timeline. If rejected, mapping might be tricky. 
    // Usually Rejected happens at "Review" or "Compliance".
    // For now, if off-path, default to -1 or handle specially.

    if (currentIndex === -1 && !isRejected && !isSuspended) {
        // Fallback or maybe it's a new status not in list
        currentIndex = 0;
    }

    return (
        <Card className="mb-6 border-border bg-card shadow-sm">
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm text-foreground">Onboarding Progress</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded border border-border/50 font-mono uppercase tracking-wide">
                            {status?.replace(/_/g, ' ')}
                        </span>
                        {isRejected && <span className="text-xs text-destructive-foreground px-2 py-0.5 bg-destructive rounded font-bold">REJECTED</span>}
                        {isSuspended && <span className="text-xs text-destructive-foreground px-2 py-0.5 bg-destructive rounded font-bold">SUSPENDED</span>}
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
            </div>

            {isOpen && (
                <div className="px-6 py-4 border-t border-border/50 bg-card">
                    <div className="relative flex items-center justify-between w-full py-6">
                        {/* Progress Bar Background */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0" />

                        {/* Progressive Active Bar */}
                        <div
                            className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500"
                            style={{ width: `${(currentIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
                        />

                        {STATUS_STEPS.map((step, index) => {
                            const isCompleted = index < currentIndex;
                            const isCurrent = index === currentIndex;
                            const isUpcoming = index > currentIndex;

                            return (
                                <div key={step.id} className="relative z-10 flex flex-col items-center group flex-1">
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-card",
                                            isCompleted ? "border-primary text-primary" :
                                                isCurrent ? "border-primary bg-primary text-primary-foreground shadow-md scale-110 ring-4 ring-primary/20" :
                                                    "border-muted text-muted-foreground bg-muted/30"
                                        )}
                                    >
                                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> :
                                            isCurrent ? <Clock className="w-4 h-4 animate-pulse" /> :
                                                <Circle className="w-3 h-3" />}
                                    </div>
                                    <span className={cn(
                                        "text-[11px] font-medium mt-2 transition-colors text-center",
                                        (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {step.label}
                                    </span>
                                    {/* Hover Tooltip */}
                                    <div className="absolute top-full mt-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border whitespace-nowrap">
                                            {step.description}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            )}
        </Card>
    );
}
