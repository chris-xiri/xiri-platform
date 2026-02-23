/**
 * XIRI Service Types
 * Master list of services offered. Grouped by category for the QuoteBuilder dropdown.
 */
export const XIRI_SERVICES = [
    // ── Janitorial (Recurring) ──────────────────────────────────────
    { value: 'nightly_janitorial', label: 'Nightly Janitorial', category: 'janitorial' as const },
    { value: 'day_porter', label: 'Day Porter', category: 'janitorial' as const },
    { value: 'restroom_sanitation', label: 'Restroom Sanitation', category: 'janitorial' as const },
    { value: 'medical_cleaning', label: 'High-Level Disinfection', category: 'janitorial' as const },

    // ── Specialized Maintenance ─────────────────────────────────────
    { value: 'floor_care', label: 'Floor Care (Strip & Wax)', category: 'specialized' as const },
    { value: 'carpet_cleaning', label: 'Carpet Cleaning', category: 'specialized' as const },
    { value: 'window_cleaning', label: 'Window Cleaning', category: 'specialized' as const },
    { value: 'post_construction', label: 'Post-Construction Cleanup', category: 'specialized' as const },
    { value: 'pressure_washing', label: 'Pressure Washing', category: 'specialized' as const },
    { value: 'hvac_filter', label: 'HVAC Filter Replacement', category: 'specialized' as const },
    { value: 'deep_clean', label: 'Deep Clean / Turnover', category: 'specialized' as const },

    // ── Consumables ─────────────────────────────────────────────────
    { value: 'consumable_procurement', label: 'Consumable Procurement', category: 'consumables' as const },
    { value: 'paper_goods', label: 'Paper Goods & Tissue', category: 'consumables' as const },
    { value: 'trash_liners', label: 'Trash Liners', category: 'consumables' as const },
    { value: 'hand_sanitizer', label: 'Hand Sanitizer & Soap', category: 'consumables' as const },

    // ── Exterior ────────────────────────────────────────────────────
    { value: 'landscaping', label: 'Landscaping', category: 'exterior' as const },
    { value: 'snow_removal', label: 'Snow & Ice Removal', category: 'exterior' as const },
    { value: 'parking_lot', label: 'Parking Lot Sweeping', category: 'exterior' as const },
] as const;

export type ServiceCategory = 'janitorial' | 'specialized' | 'consumables' | 'exterior';

export const SERVICE_CATEGORIES: Record<ServiceCategory, string> = {
    janitorial: 'Janitorial',
    specialized: 'Specialized Maintenance',
    consumables: 'Consumables',
    exterior: 'Exterior',
};
