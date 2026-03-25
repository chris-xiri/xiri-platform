import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// ─── AUTHORITY FUNNEL: TWO PILLARS ─────────────────────────────────

export const PILLAR_CLEANING_HREF = '/services/commercial-cleaning';
export const PILLAR_CLEANING_TEXT = 'Commercial Cleaning Services';

export const PILLAR_FACILITY_HREF = '/services/facility-management';
export const PILLAR_FACILITY_TEXT = 'Facility and Building Management Services';

export const PILLAR_PM_HREF = '/services/preventive-maintenance';
export const PILLAR_PM_TEXT = 'Preventive Maintenance Programs';

// Legacy aliases (guides, blog, tools, solutions all link to cleaning pillar)
export const PILLAR_HREF = PILLAR_CLEANING_HREF;
export const PILLAR_ANCHOR_TEXT = PILLAR_CLEANING_TEXT;

// Services that belong under the Facility Management pillar
const FACILITY_MGMT_SLUGS = new Set([
    'hvac-maintenance',
    'pest-control',
    'waste-management',
    'parking-lot-maintenance',
    'handyman-services',
    'pressure-washing',
    'snow-ice-removal',
]);

// Services that belong under the Preventive Maintenance pillar
const PREVENTIVE_MAINT_SLUGS = new Set([
    'preventive-maintenance',
    'consumable-procurement',
]);

/** Returns the correct pillar for a given service slug */
export function getPillarForService(slug: string): { href: string; text: string } {
    if (PREVENTIVE_MAINT_SLUGS.has(slug)) {
        return { href: PILLAR_PM_HREF, text: PILLAR_PM_TEXT };
    }
    if (FACILITY_MGMT_SLUGS.has(slug)) {
        return { href: PILLAR_FACILITY_HREF, text: PILLAR_FACILITY_TEXT };
    }
    return { href: PILLAR_CLEANING_HREF, text: PILLAR_CLEANING_TEXT };
}

export interface BreadcrumbItem {
    label: string;
    href?: string; // if omitted, renders as current page (no link)
}

interface AuthorityBreadcrumbProps {
    items: BreadcrumbItem[];
    /** Override the default pillar. Use getPillarForService() for service pages. */
    pillar?: { href: string; text: string };
}

/**
 * Above-fold breadcrumb nav implementing the Authority Funnel protocol.
 *
 * By default, links to the Commercial Cleaning pillar.
 * Pass a `pillar` prop to override for Facility Management pages.
 *
 * Breadcrumb schema (JSON-LD) should be added separately in each page's structured data.
 */
export function AuthorityBreadcrumb({ items, pillar }: AuthorityBreadcrumbProps) {
    const activePillar = pillar ?? { href: PILLAR_CLEANING_HREF, text: PILLAR_CLEANING_TEXT };

    // Prepend Home + Pillar automatically
    const fullItems: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: activePillar.text, href: activePillar.href },
        ...items,
    ];

    return (
        <nav className="bg-slate-50 border-b border-slate-200" aria-label="Breadcrumb">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                <ol className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
                    {fullItems.map((item, i) => {
                        const isLast = i === fullItems.length - 1;
                        const isPillar = i === 1; // The pillar link gets special styling
                        return (
                            <li key={i} className="flex items-center gap-1.5">
                                {i > 0 && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
                                {isLast || !item.href ? (
                                    <span className="text-slate-900 font-medium truncate max-w-xs">{item.label}</span>
                                ) : isPillar ? (
                                    <Link href={item.href} className="text-sky-700 font-medium hover:underline">
                                        {item.label}
                                    </Link>
                                ) : (
                                    <Link href={item.href} className="hover:text-sky-700 transition-colors">
                                        {item.label}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </nav>
    );
}
