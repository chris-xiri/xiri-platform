import { useState, useMemo } from 'react';
import { Contact, LeadStatus } from '@xiri-facility-solutions/shared';

export type EngagementFilter = 'clicked' | 'opened' | 'delivered' | 'bounced' | null;

/**
 * Generic filter hook — works with both Contact[] for the new model 
 * and still structurally compatible with Lead[].
 * Searches across contact fields AND denormalized companyName.
 */
export function useLeadFilter(items: Contact[], statusFilters?: LeadStatus[], engagementFilter?: EngagementFilter) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');

    const filteredLeads = useMemo(() => {
        let filtered = items;

        // Apply status filter from props (if provided) — status lives on company, 
        // but is denormalized on the contact row via _companyStatus
        if (statusFilters && statusFilters.length > 0) {
            filtered = filtered.filter(c =>
                statusFilters.includes((c as any)._companyStatus)
            );
        }

        // Apply user-selected status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(c =>
                (c as any)._companyStatus === statusFilter
            );
        }

        // Apply engagement filter (from funnel card clicks)
        if (engagementFilter) {
            filtered = filtered.filter(c => {
                const eng = (c as any).emailEngagement;
                if (!eng?.lastEvent) return false;
                const event = eng.lastEvent as string;
                switch (engagementFilter) {
                    case 'clicked':
                        return event === 'clicked';
                    case 'opened':
                        return event === 'opened' || event === 'clicked';
                    case 'delivered':
                        return event === 'delivered' || event === 'opened' || event === 'clicked';
                    case 'bounced':
                        return event === 'bounced' || event === 'spam';
                    default:
                        return true;
                }
            });
        }

        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(contact => {
                const firstName = contact.firstName?.toLowerCase() || '';
                const lastName = contact.lastName?.toLowerCase() || '';
                const email = contact.email?.toLowerCase() || '';
                const phone = contact.phone?.toLowerCase() || '';
                const companyName = contact.companyName?.toLowerCase() || '';
                const role = contact.role?.toLowerCase() || '';

                // Also search company-level fields that are denormalized
                const address = (contact as any)._companyAddress?.toLowerCase() || '';
                const city = (contact as any)._companyCity?.toLowerCase() || '';
                const state = (contact as any)._companyState?.toLowerCase() || '';
                const zip = (contact as any)._companyZip?.toLowerCase() || '';

                return (
                    firstName.includes(query) ||
                    lastName.includes(query) ||
                    `${firstName} ${lastName}`.includes(query) ||
                    email.includes(query) ||
                    phone.includes(query) ||
                    companyName.includes(query) ||
                    role.includes(query) ||
                    address.includes(query) ||
                    city.includes(query) ||
                    state.includes(query) ||
                    zip.includes(query)
                );
            });
        }

        return filtered;
    }, [items, searchQuery, statusFilter, statusFilters, engagementFilter]);

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
