'use client';

import React from 'react';
import { Vendor } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
    Building2, Shield, Users, Car, Droplet, FileText, AlertTriangle
} from 'lucide-react';

interface VendorComplianceProps {
    vendor: Vendor;
}

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

    const ComplianceItem = ({
        icon: Icon,
        label,
        value,
        verified,
        required = false,
        description
    }: {
        icon: any;
        label: string;
        value: boolean | undefined;
        verified?: boolean;
        required?: boolean;
        description?: string;
    }) => (
        <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className={`p-2 rounded-lg ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{label}</h4>
                    {required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                </div>
                {description && <p className="text-sm text-muted-foreground mb-2">{description}</p>}
                <div className="flex items-center gap-2">
                    {value ? (
                        <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Confirmed</span>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-700">Not Available</span>
                        </>
                    )}
                    {verified !== undefined && (
                        <Badge variant={verified ? "default" : "outline"} className="ml-2">
                            {verified ? "Verified ✓" : "Pending Verification"}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Compliance Score Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Compliance Overview</CardTitle>
                            <CardDescription>Onboarding form responses and verification status</CardDescription>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold">{complianceScore}%</div>
                            <div className="text-sm text-muted-foreground">Compliance Score</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        {complianceScore === 100 ? (
                            <>
                                <ShieldCheck className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium text-green-700">Fully Compliant</span>
                            </>
                        ) : complianceScore >= 75 ? (
                            <>
                                <ShieldAlert className="w-5 h-5 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-700">Mostly Compliant</span>
                            </>
                        ) : (
                            <>
                                <ShieldAlert className="w-5 h-5 text-red-600" />
                                <span className="text-sm font-medium text-red-700">Non-Compliant</span>
                            </>
                        )}
                        <span className="text-sm text-muted-foreground ml-2">
                            ({metRequirements} of {totalRequirements} requirements met)
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Business Structure */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Business Structure
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ComplianceItem
                        icon={Building2}
                        label="Registered Business Entity"
                        value={compliance.hasBusinessEntity}
                        required={true}
                        description="LLC, Corporation, or other registered business entity"
                    />
                </CardContent>
            </Card>

            {/* Insurance Coverage */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Insurance Coverage
                    </CardTitle>
                    <CardDescription>All insurance responses from onboarding form</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ComplianceItem
                        icon={Shield}
                        label="General Liability Insurance"
                        value={compliance.generalLiability?.hasInsurance}
                        verified={compliance.generalLiability?.verified}
                        required={true}
                        description="Minimum $1M coverage required"
                    />

                    <ComplianceItem
                        icon={Users}
                        label="Workers' Compensation Insurance"
                        value={compliance.workersComp?.hasInsurance}
                        verified={compliance.workersComp?.verified}
                        description={`Required in certain states (CA, NY, IL, etc.)`}
                    />

                    <ComplianceItem
                        icon={Car}
                        label="Commercial Auto Insurance"
                        value={compliance.autoInsurance?.hasInsurance}
                        verified={compliance.autoInsurance?.verified}
                        description="Required for vendors with company vehicles"
                    />

                    {/* Additional Insurance */}
                    {compliance.additionalInsurance && compliance.additionalInsurance.length > 0 && (
                        <>
                            <div className="pt-4 border-t">
                                <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                                    Trade-Specific Insurance
                                </h4>
                            </div>
                            {compliance.additionalInsurance.map((ins: any, idx: number) => (
                                <ComplianceItem
                                    key={idx}
                                    icon={Droplet}
                                    label={ins.type}
                                    value={ins.hasInsurance}
                                    verified={ins.verified}
                                    required={true}
                                    description="Required for medical facility janitorial services"
                                />
                            ))}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Required Documentation
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ComplianceItem
                        icon={FileText}
                        label="IRS Form W-9"
                        value={compliance.w9Collected}
                        description="Tax documentation for 1099 reporting"
                    />
                </CardContent>
            </Card>

            {/* Action Items */}
            {complianceScore < 100 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Action Required:</strong> This vendor needs to complete missing compliance items before being assigned to contracts.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
