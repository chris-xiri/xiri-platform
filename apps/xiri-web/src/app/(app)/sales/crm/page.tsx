'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SalesCRMPage() {
    return (
        <ProtectedRoute resource="sales/crm">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Sales CRM</h1>
                    <p className="text-muted-foreground">Manage your sales leads and client relationships</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Coming Soon</CardTitle>
                        <CardDescription>Sales CRM features are under development</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            This page will display your sales leads with activity tracking, outreach history, and deal management.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </ProtectedRoute>
    );
}
