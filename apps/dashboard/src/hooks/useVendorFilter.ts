
import { useState, useMemo } from "react";
import { Vendor } from "@xiri/shared";

export function useVendorFilter(vendors: Vendor[], statusFilters?: string[]) {
    const [searchQuery, setSearchQuery] = useState("");
    const [outreachFilter, setOutreachFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const filteredVendors = useMemo(() => {
        return vendors.filter(vendor => {
            // Search
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch =
                (vendor.businessName?.toLowerCase() || "").includes(searchLower) ||
                (vendor.capabilities?.some(c => c.toLowerCase().includes(searchLower))) ||
                (vendor.address?.toLowerCase() || "").includes(searchLower);

            // Status Filter
            const matchesStatus = statusFilter === "ALL" || vendor.status === statusFilter;

            // Outreach Filter
            let matchesOutreach = true;
            if (outreachFilter !== "ALL") {
                const os = vendor.outreachStatus || "NONE";
                if (outreachFilter === "PENDING") matchesOutreach = os === "PENDING";
                else if (outreachFilter === "SENT") matchesOutreach = os === "SENT";
                else if (outreachFilter === "NONE") matchesOutreach = !vendor.outreachStatus;
            }

            // Strict Prop Filter
            const matchesPropFilters = !statusFilters || statusFilters.length === 0 || statusFilters.includes(vendor.status);

            return matchesSearch && matchesStatus && matchesOutreach && matchesPropFilters;
        });
    }, [vendors, searchQuery, statusFilter, outreachFilter, statusFilters]);

    const resetFilters = () => {
        setSearchQuery("");
        setStatusFilter("ALL");
        setOutreachFilter("ALL");
    };

    const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || outreachFilter !== "ALL";

    return {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        outreachFilter,
        setOutreachFilter,
        filteredVendors,
        resetFilters,
        hasActiveFilters
    };
}
