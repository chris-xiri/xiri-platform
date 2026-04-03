'use client';

import React from 'react';
import { Vendor } from '@xiri-facility-solutions/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
    Building2, Shield, Users, Car, Droplet, FileText, AlertTriangle,
    Download, ExternalLink
} from 'lucide-react';

interface VendorComplianceProps {
    vendor: Vendor;
}

// ... imports ...

export default function VendorCompliance({ vendor }: VendorComplianceProps) {
    const compliance = vendor.compliance;

    if (!compliance) {
        return (
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    This vendor has not completed the onboarding form yet.
                </AlertDescription>
            </Alert>
        );
    }

    // Calculate compliance score
    const requirements = [
        compliance.hasBusinessEntity,
        compliance.generalLiability?.hasInsurance,
        compliance.workersComp?.hasInsurance,
        compliance.autoInsurance?.hasInsurance,
    ];

    const metRequirements = requirements.filter(Boolean).length;
    const totalRequirements = requirements.length;
    const complianceScore = Math.round((metRequirements / totalRequirements) * 100);

    const CompactItem = ({ icon: Icon, label, value, verified, required }: any) => (
        <div className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors text-sm">
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-foreground">{label}</span>
                {required && <span className="text-[10px] text-red-500 font-semibold">*</span>}
            </div>
            <div className="flex items-center gap-2">
                {verified !== undefined && (
                    <Badge variant={verified ? "outline" : "secondary"} className="text-[10px] h-5 px-1.5 font-normal">
                        {verified ? "Verified" : "Pending"}
                    </Badge>
                )}
                {value ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                )}
            </div>
        </div>
    );

    const acord25 = compliance.acord25 as any;

    return (
        <div className="space-y-4">
            {/* ACORD 25 Document */}
            {acord25?.url && (
                <div className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-full bg-blue-100 text-blue-700">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">ACORD 25 — Certificate of Insurance</p>
                                <p className="text-xs text-muted-foreground">
                                    Uploaded{acord25.uploadedAt?.toDate ? ` ${acord25.uploadedAt.toDate().toLocaleDateString()}` : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={acord25.status === 'VERIFIED' ? 'default' : 'outline'}
                                className={acord25.status === 'VERIFIED' ? 'bg-green-600' : acord25.status === 'REJECTED' ? 'border-red-400 text-red-600' : ''}
                            >
                                {acord25.status || 'PENDING'}
                            </Badge>
                            <a
                                href={acord25.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View PDF
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Header / Score */}
            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                <div>
                    <h3 className="font-semibold text-sm">Compliance Score</h3>
                    <p className="text-xs text-muted-foreground">{metRequirements}/{totalRequirements} Requirements Met</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${complianceScore === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {complianceScore}%
                    </span>
                    <Badge variant={complianceScore === 100 ? "default" : "outline"}>
                        {complianceScore === 100 ? "Compliant" : "Review"}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Core Legal */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legal & Structure</h4>
                    <CompactItem
                        icon={Building2}
                        label="Business Entity"
                        value={compliance.hasBusinessEntity}
                        required={true}
                    />
                    <CompactItem
                        icon={FileText}
                        label="W-9 Form"
                        value={compliance.w9Collected}
                    />
                </div>

                {/* Column 2: Insurance */}
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Insurance</h4>
                    <CompactItem
                        icon={Shield}
                        label="General Liability"
                        value={compliance.generalLiability?.hasInsurance}
                        verified={compliance.generalLiability?.verified}
                        required={true}
                    />
                    <CompactItem
                        icon={Users}
                        label="Workers' Comp"
                        value={compliance.workersComp?.hasInsurance}
                        verified={compliance.workersComp?.verified}
                    />
                    <CompactItem
                        icon={Car}
                        label="Commercial Auto"
                        value={compliance.autoInsurance?.hasInsurance}
                        verified={compliance.autoInsurance?.verified}
                    />
                    {compliance.additionalInsurance?.map((ins: any, idx: number) => (
                        <CompactItem
                            key={idx}
                            icon={Droplet}
                            label={ins.type}
                            value={ins.hasInsurance}
                            verified={ins.verified}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
