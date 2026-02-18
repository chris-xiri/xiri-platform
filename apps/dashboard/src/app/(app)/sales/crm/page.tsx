'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LeadList from '@/components/LeadList';
import { AddLeadDialog } from '@/components/AddLeadDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function SalesCRMPage() {
    const [showAddLead, setShowAddLead] = useState(false);

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Sales CRM</h1>
                        <p className="text-muted-foreground">Manage your sales leads and client relationships</p>
                    </div>
                    <Button onClick={() => setShowAddLead(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Lead
                    </Button>
                </div>

                <div className="flex-1 min-h-0">
                    <LeadList title="Sales Pipeline" />
                </div>
            </div>

            <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} />
        </ProtectedRoute>
    );
}
