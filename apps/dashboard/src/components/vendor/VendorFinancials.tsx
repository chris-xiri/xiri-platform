'use client';

import { Vendor } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Landmark, FileText } from 'lucide-react';

interface VendorFinancialsProps {
    vendor: Vendor;
}

export default function VendorFinancials({ vendor }: VendorFinancialsProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tax Docs - Keep as it uses real vendor data */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Tax Documents
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">W-9 Form</span>
                            {vendor.compliance?.w9?.status === 'VERIFIED' ? (
                                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 bg-green-50 dark:bg-green-950/30">Verified</Badge>
                            ) : (
                                <Badge variant="secondary">Not Submitted</Badge>
                            )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">1099 Status</span>
                            <Badge variant="secondary">Pending</Badge>
                        </div>
                        <Separator />
                        <Button variant="secondary" size="sm" className="w-full">
                            Request W-9
                        </Button>
                    </CardContent>
                </Card>

                {/* Placeholder for Financials */}
                <Card className="bg-muted/5 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <Landmark className="w-10 h-10 mb-3 opacity-20" />
                        <h3 className="font-medium text-foreground">Financial Setup Incomplete</h3>
                        <p className="text-sm mt-1 max-w-xs">
                            Payment methods and transaction history will be available once the vendor completes onboarding.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
