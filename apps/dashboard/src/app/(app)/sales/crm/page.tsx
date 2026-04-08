'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import LeadList from '@/components/LeadList';
import { AddLeadDialog } from '@/components/AddLeadDialog';
import LeadDetailDrawer from '@/components/lead/LeadDetailDrawer';
import ProspectorPanel from '@/components/ProspectorPanel';
import { Button } from '@/components/ui/button';
import { Plus, Radar } from 'lucide-react';

export default function SalesCRMPage() {
    const [showAddLead, setShowAddLead] = useState(false);
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
    const [showProspector, setShowProspector] = useState(false);

    return (
        <ProtectedRoute resource="sales/crm">
            <div className="h-full flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Sales CRM</h1>
                        <p className="text-muted-foreground">Manage your sales leads and client relationships</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={showProspector ? 'secondary' : 'outline'}
                            onClick={() => setShowProspector(!showProspector)}
                            className="gap-2"
                        >
                            <Radar className="w-4 h-4" />
                            Prospector
                        </Button>
                        <Button onClick={() => setShowAddLead(true)} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Add Contact
                        </Button>
                    </div>
                </div>

                {/* Prospector dropdown panel */}
                <ProspectorPanel
                    isOpen={showProspector}
                    onClose={() => setShowProspector(false)}
                />

                <div className="flex-1 min-h-0">
                    <LeadList
                        title="Sales Pipeline"
                        onRowClick={(contactId) => setDrawerContactId(contactId)}
                    />
                </div>
            </div>

            <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} />

            <LeadDetailDrawer
                leadId={drawerContactId}
                open={!!drawerContactId}
                onClose={() => setDrawerContactId(null)}
            />
        </ProtectedRoute>
    );
}
