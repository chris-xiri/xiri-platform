'use client';

import { Vendor } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Landmark, CreditCard, Download, FileText, CheckCircle2 } from 'lucide-react';

interface VendorFinancialsProps {
    vendor: Vendor;
}

export default function VendorFinancials({ vendor }: VendorFinancialsProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Payout Method */}
                <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Landmark className="w-4 h-4" /> Payout Method
                        </CardTitle>
                        <CardDescription>How we pay this vendor</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-white border rounded flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="font-medium">Direct Deposit (ACH)</div>
                                    <div className="text-sm text-muted-foreground">**** 4291</div>
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                            </Badge>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Button variant="outline" size="sm">Update Banking</Button>
                            <Button variant="outline" size="sm">View Stripe Connect</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tax Docs */}
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
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Verified</Badge>
                            ) : (
                                <Badge variant="destructive">Missing</Badge>
                            )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">1099 Status</span>
                            <Badge variant="secondary">Not Issued</Badge>
                        </div>
                        <Separator />
                        <Button variant="secondary" size="sm" className="w-full">
                            Request W-9
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Payout History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Payout History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="grid grid-cols-5 bg-muted/50 p-3 text-xs font-medium text-muted-foreground">
                            <div>Date</div>
                            <div className="col-span-2">Description</div>
                            <div className="text-right">Amount</div>
                            <div className="text-right">Status</div>
                        </div>
                        {[
                            { date: 'Feb 01, 2026', desc: 'Janitorial Services - Jan 2026', amount: 3250.00, status: 'Paid' },
                            { date: 'Jan 01, 2026', desc: 'Janitorial Services - Dec 2025', amount: 3250.00, status: 'Paid' },
                        ].map((tx, i) => (
                            <div key={i} className="grid grid-cols-5 p-3 text-sm border-t hover:bg-muted/5">
                                <div>{tx.date}</div>
                                <div className="col-span-2 font-medium">{tx.desc}</div>
                                <div className="text-right font-mono">${tx.amount.toFixed(2)}</div>
                                <div className="text-right">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        {tx.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
