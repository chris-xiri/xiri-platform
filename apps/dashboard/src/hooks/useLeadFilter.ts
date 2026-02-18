import { useState, useMemo } from 'react';
import { Lead, LeadStatus } from '@xiri/shared';

export function useLeadFilter(leads: Lead[], statusFilters?: LeadStatus[]) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');

    const filteredLeads = useMemo(() => {
        let filtered = leads;

        // Apply status filter from props (if provided)
        if (statusFilters && statusFilters.length > 0) {
            filtered = filtered.filter(lead => statusFilters.includes(lead.status));
        }

        // Apply user-selected status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(lead => lead.status === statusFilter);
        }

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(lead => {
                const businessName = lead.businessName?.toLowerCase() || '';
                const contactName = lead.contactName?.toLowerCase() || '';
                const email = lead.email?.toLowerCase() || '';
                const phone = lead.contactPhone?.toLowerCase() || '';
                const address = lead.address?.toLowerCase() || '';
                const zipCode = lead.zipCode?.toLowerCase() || '';

                return (
                    businessName.includes(query) ||
                    contactName.includes(query) ||
                    email.includes(query) ||
                    phone.includes(query) ||
                    address.includes(query) ||
                    zipCode.includes(query)
                );
            });
        }

        return filtered;
    }, [leads, searchQuery, statusFilter, statusFilters]);

    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
    };

    const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

    return {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredLeads,
        resetFilters,
        hasActiveFilters
    };
}
