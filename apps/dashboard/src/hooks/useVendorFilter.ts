
import { useState, useMemo } from "react";
import { Vendor } from "@xiri/shared";

export function useVendorFilter(vendors: Vendor[], statusFilters?: string[]) {
    const [searchQuery, setSearchQuery] = useState("");
    const [outreachFilter, setOutreachFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const filteredVendors = useMemo(() => {
        return vendors.filter(vendor => {
            // Unified Search (Name, Capabilities, Location)
            const lowerQuery = searchQuery.toLowerCase();
            const searchTerms = lowerQuery.split(" "); // simple tokenization

            // Check if ALL terms match SOMETHING in the vendor record (and logic)
            // or if the whole phrase matches widely (or logic)
            // Let's stick to a broad "OR" across fields for the full query string first for simplicity/performance
            // "cleaning in manhasset" -> "cleaning" AND "manhasset" finding?

            // Allow active "AND" search for words
            const matchesSearch = searchTerms.every(term => {
                if (term === "in") return true; // skip connector words
                return (
                    (vendor.businessName?.toLowerCase() || "").includes(term) ||
                    (vendor.capabilities?.some(c => c.toLowerCase().includes(term))) ||
                    (vendor.city?.toLowerCase() || "").includes(term) ||
                    (vendor.state?.toLowerCase() || "").includes(term) ||
                    (vendor.zip?.toLowerCase() || "").includes(term) ||
                    (vendor.address?.toLowerCase() || "").includes(term)
                );
            });

            // Status Filter
            const matchesStatus = statusFilter === "ALL" || vendor.status === statusFilter;

            // Outreach Filter
            const matchesOutreach = outreachFilter === "ALL" ||
                (outreachFilter === "PENDING" && (!vendor.outreachStatus || vendor.outreachStatus === "PENDING")) ||
                vendor.outreachStatus === outreachFilter;

            // Prop Filters (from Recruitment page)
            const matchesPropFilters = !statusFilters || statusFilters.length === 0 ||
                statusFilters.map(s => s.toLowerCase()).includes((vendor.status || "").toLowerCase());

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
