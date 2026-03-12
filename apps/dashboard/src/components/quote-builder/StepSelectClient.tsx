'use client';

import { useState } from 'react';
import { Lead } from '@xiri-facility-solutions/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface StepSelectClientProps {
    leads: (Lead & { id: string })[];
    selectedLead: (Lead & { id: string }) | null;
    onSelectLead: (lead: Lead & { id: string }) => void;
    existingQuoteId: string | null;
    onClose: () => void;
}

export default function StepSelectClient({
    leads, selectedLead, onSelectLead, existingQuoteId, onClose,
}: StepSelectClientProps) {
    const router = useRouter();
    const [leadSearch, setLeadSearch] = useState('');

    const filteredLeads = leads.filter(l =>
        l.businessName?.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.contactName?.toLowerCase().includes(leadSearch.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <Input
                placeholder="Search clients by name..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="mb-2"
            />
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No leads found. Create a lead in the Sales CRM first.
                    </p>
                ) : (
                    filteredLeads.map((lead) => (
                        <Card
                            key={lead.id}
                            className={`cursor-pointer transition-all hover:border-primary/50 ${selectedLead?.id === lead.id
                                ? 'border-primary ring-2 ring-primary/20'
                                : ''
                                }`}
                            onClick={() => onSelectLead(lead)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">{lead.businessName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {lead.contactName} • {lead.zipCode}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {lead.facilityType?.replace(/_/g, ' ') || 'Unknown'}
                                    </Badge>
                                    {selectedLead?.id === lead.id && (
                                        <Check className="w-5 h-5 text-primary" />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Duplicate quote warning */}
            {existingQuoteId && selectedLead && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 mb-2">
                        ⚠️ {selectedLead.businessName} already has an active quote.
                    </p>
                    <p className="text-xs text-amber-600 mb-3">
                        To add services or update pricing, revise the existing quote instead of creating a new one.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-100"
                        onClick={() => {
                            onClose();
                            router.push(`/sales/quotes/${existingQuoteId}`);
                        }}
                    >
                        Go to Existing Quote →
                    </Button>
                </div>
            )}
        </div>
    );
}
