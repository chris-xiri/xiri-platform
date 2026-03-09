import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// ─── AUTHORITY FUNNEL CONSTANTS ────────────────────────────────────
export const PILLAR_HREF = '/services/commercial-cleaning';
export const PILLAR_ANCHOR_TEXT = 'Commercial Cleaning Services';

export interface BreadcrumbItem {
    label: string;
    href?: string; // if omitted, renders as current page (no link)
}

/**
 * Above-fold breadcrumb nav implementing the Authority Funnel protocol.
 *
 * Every spoke and hub page links back to the pillar (/services/commercial-cleaning)
 * with consistent anchor text "Commercial Cleaning Services" for maximum link equity.
 *
 * Breadcrumb schema (JSON-LD) should be added separately in each page's structured data.
 */
export function AuthorityBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
    // Prepend Home + Pillar automatically
    const fullItems: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: PILLAR_ANCHOR_TEXT, href: PILLAR_HREF },
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
