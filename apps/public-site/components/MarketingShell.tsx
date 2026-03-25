'use client';

import { usePathname } from 'next/navigation';

/**
 * Wraps marketing elements (nav, footer, popups) and hides them
 * on NFC check-in pages (/s/ and /z/) where only the minimal
 * NFC layout should be visible.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isNfcPage = pathname.startsWith('/s/') || pathname.startsWith('/z/') || pathname.startsWith('/c/') || pathname.startsWith('/onboarding/') || pathname.startsWith('/demo');

    if (isNfcPage) return null;

    return <>{children}</>;
}
