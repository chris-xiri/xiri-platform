'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import LeadList from '@/components/LeadList';

export default function SalesCRMPage() {
    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                <div>
                    <h1 className="text-3xl font-bold">Sales CRM</h1>
                    <p className="text-muted-foreground">Manage your sales leads and client relationships</p>
                </div>

                <div className="flex-1 min-h-0">
                    <LeadList title="Sales Pipeline" />
                </div>
            </div>
        </ProtectedRoute>
    );
}
