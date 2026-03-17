'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    LayoutDashboard,
    ClipboardList,
    FileText,
    Receipt,
    Menu,
} from 'lucide-react';

interface BottomTab {
    label: string;
    href: string;
    icon: React.ReactNode;
    match?: string[]; // additional path prefixes that count as "active"
}

export function MobileBottomNav({ onMorePress }: { onMorePress: () => void }) {
    const pathname = usePathname();
    const { profile } = useAuth();

    if (!profile) return null;

    // Role-based home route
    const isSupply = profile.roles?.some((r: string) => ['recruiter'].includes(r)) && !profile.roles?.includes('admin');
    const homeHref = isSupply ? '/supply/dashboard' : '/sales/dashboard';

    const tabs: BottomTab[] = [
        {
            label: 'Home',
            href: homeHref,
            icon: <LayoutDashboard className="w-5 h-5" />,
            match: ['/sales/dashboard', '/supply/dashboard'],
        },
        {
            label: 'Orders',
            href: '/operations/work-orders',
            icon: <ClipboardList className="w-5 h-5" />,
            match: ['/operations/work-orders'],
        },
        {
            label: 'Quotes',
            href: '/sales/quotes',
            icon: <FileText className="w-5 h-5" />,
            match: ['/sales/quotes', '/operations/contracts'],
        },
        {
            label: 'Finance',
            href: '/accounting/invoices',
            icon: <Receipt className="w-5 h-5" />,
            match: ['/accounting/invoices', '/accounting/commissions', '/accounting/vendor-remittances'],
        },
    ];

    const isActive = (tab: BottomTab) => {
        if (pathname === tab.href) return true;
        return tab.match?.some(prefix => pathname.startsWith(prefix)) ?? false;
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom">
            <div className="flex items-stretch justify-around">
                {tabs.map(tab => {
                    const active = isActive(tab);
                    return (
                        <Link
                            key={tab.label}
                            href={tab.href}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pt-2.5 text-[10px] font-medium transition-colors
                                ${active
                                    ? 'text-sky-600 dark:text-sky-400'
                                    : 'text-muted-foreground hover:text-foreground'
                                }
                            `}
                        >
                            <span className={active ? 'text-sky-600 dark:text-sky-400' : ''}>
                                {tab.icon}
                            </span>
                            {tab.label}
                        </Link>
                    );
                })}
                {/* More button opens sidebar drawer */}
                <button
                    onClick={onMorePress}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 pt-2.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Menu className="w-5 h-5" />
                    More
                </button>
            </div>
        </nav>
    );
}
