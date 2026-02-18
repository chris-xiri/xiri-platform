'use client';

import React, { useState } from 'react';
import { Vendor } from '@xiri/shared';
import {
    CheckCircle2, Circle, ChevronDown, ChevronUp, Clock,
    Search, CheckCircle, Mail, FileText, ShieldCheck,
    FileSearch, CalendarCheck, Rocket, Star, Ban, Pause, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Unified pipeline steps — mirrors CRM tabs exactly
const PIPELINE_STEPS = [
    { id: 'pending_review', label: 'Sourced', description: 'Lead scraped or manually added', icon: Search, color: 'sky' },
    { id: 'qualified', label: 'Qualified', description: 'Approved for outreach', icon: CheckCircle, color: 'blue' },
    { id: 'awaiting_onboarding', label: 'Awaiting Form', description: 'Outreach sent, waiting for response', icon: Mail, color: 'indigo' },
    { id: 'compliance_review', label: 'Compliance', description: 'Form submitted, reviewing docs', icon: ShieldCheck, color: 'amber' },
    { id: 'pending_verification', label: 'Verifying Docs', description: 'Insurance & license verification', icon: FileSearch, color: 'orange' },
    { id: 'onboarding_scheduled', label: 'Onboarding Call', description: 'Intro call scheduled', icon: CalendarCheck, color: 'violet' },
    { id: 'ready_for_assignment', label: 'Ready', description: 'Cleared for work orders', icon: Rocket, color: 'teal' },
    { id: 'active', label: 'Active', description: 'Servicing contracts', icon: Star, color: 'emerald' },
];

// Terminal/off-path states
const TERMINAL_STATES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    'rejected': { label: 'Rejected', icon: XCircle, color: 'red' },
    'dismissed': { label: 'Dismissed', icon: Ban, color: 'red' },
    'suspended': { label: 'Suspended', icon: Pause, color: 'orange' },
};

interface VendorStatusTimelineProps {
    status: Vendor['status'];
}

export default function VendorStatusTimeline({ status }: VendorStatusTimelineProps) {
    const [isOpen, setIsOpen] = useState(status !== 'active');

    const normalizedStatus = (status || 'pending_review').toLowerCase();
    const currentIndex = PIPELINE_STEPS.findIndex(s => s.id === normalizedStatus);
    const isTerminal = normalizedStatus in TERMINAL_STATES;
    const terminalInfo = isTerminal ? TERMINAL_STATES[normalizedStatus] : null;

    // Split into 2 rows for snaking layout
    const ROW_SIZE = 4;
    const row1 = PIPELINE_STEPS.slice(0, ROW_SIZE);     // Left → Right
    const row2 = PIPELINE_STEPS.slice(ROW_SIZE);          // Right → Left (reversed visually)

    return (
        <Card className="mb-6 border-border bg-card shadow-sm">
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm text-foreground">Vendor Pipeline</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded border border-border/50 font-mono uppercase tracking-wide">
                            {normalizedStatus.replace(/_/g, ' ')}
                        </span>
                        {isTerminal && terminalInfo && (
                            <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                                {terminalInfo.label}
                            </Badge>
                        )}
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
            </div>

            {isOpen && (
                <div className="px-6 py-5 border-t border-border/50 bg-card">
                    {/* Row 1: Left → Right */}
                    <div className="flex items-center w-full">
                        {row1.map((step, index) => {
                            const stepIndex = index;
                            return (
                                <React.Fragment key={step.id}>
                                    <StepNode
                                        step={step}
                                        stepIndex={stepIndex}
                                        currentIndex={isTerminal ? -1 : currentIndex}
                                    />
                                    {index < row1.length - 1 && (
                                        <StepConnector
                                            isCompleted={!isTerminal && stepIndex < currentIndex}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Snake connector — right-side curve */}
                    <div className="flex justify-end pr-6 my-0">
                        <div
                            className={cn(
                                "w-0.5 h-8 mr-3 transition-colors duration-300",
                                !isTerminal && currentIndex >= ROW_SIZE ? "bg-primary" :
                                    !isTerminal && currentIndex === ROW_SIZE - 1 ? "bg-primary/40" :
                                        "bg-muted"
                            )}
                        />
                    </div>

                    {/* Row 2: Right → Left (visually reversed) */}
                    <div className="flex items-center w-full flex-row-reverse">
                        {row2.map((step, index) => {
                            const stepIndex = ROW_SIZE + index;
                            return (
                                <React.Fragment key={step.id}>
                                    <StepNode
                                        step={step}
                                        stepIndex={stepIndex}
                                        currentIndex={isTerminal ? -1 : currentIndex}
                                    />
                                    {index < row2.length - 1 && (
                                        <StepConnector
                                            isCompleted={!isTerminal && stepIndex < currentIndex}
                                            reversed
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Terminal state banner */}
                    {isTerminal && terminalInfo && (
                        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                            <terminalInfo.icon className="w-4 h-4 text-destructive" />
                            <span className="text-sm font-medium text-destructive">
                                This vendor was {terminalInfo.label.toLowerCase()} and is no longer in the active pipeline.
                            </span>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

// --- Step Node ---
function StepNode({ step, stepIndex, currentIndex }: {
    step: typeof PIPELINE_STEPS[number];
    stepIndex: number;
    currentIndex: number;
}) {
    const isCompleted = stepIndex < currentIndex;
    const isCurrent = stepIndex === currentIndex;
    const Icon = step.icon;

    return (
        <div className="relative flex flex-col items-center group flex-1 min-w-0">
            <div
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-card",
                    isCompleted
                        ? "border-primary text-primary"
                        : isCurrent
                            ? "border-primary bg-primary text-primary-foreground shadow-lg scale-110 ring-4 ring-primary/20"
                            : "border-muted text-muted-foreground bg-muted/30"
                )}
            >
                {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                ) : isCurrent ? (
                    <Clock className="w-5 h-5 animate-pulse" />
                ) : (
                    <Icon className="w-4 h-4" />
                )}
            </div>
            <span className={cn(
                "text-[10px] font-medium mt-1.5 transition-colors text-center leading-tight",
                isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
            )}>
                {step.label}
            </span>
            {/* Hover tooltip */}
            <div className="absolute top-full mt-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border whitespace-nowrap">
                    {step.description}
                </div>
            </div>
        </div>
    );
}

// --- Step Connector Line ---
function StepConnector({ isCompleted, reversed }: { isCompleted: boolean; reversed?: boolean }) {
    return (
        <div className={cn(
            "flex-1 h-0.5 transition-colors duration-300 mx-1",
            isCompleted ? "bg-primary" : "bg-muted"
        )} />
    );
}
