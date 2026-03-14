'use client';

import { usePathname } from 'next/navigation';

/**
 * Hides the global footer on tool pages (calculator, etc.)
 * where users should stay focused on the tool, not browse away.
 */
export function ConditionalFooter({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const toolPages = ['/calculator', '/contractors/calculator'];
    const isToolPage = toolPages.some(p => pathname === p || pathname.startsWith(p + '/'));

    if (isToolPage) return null;

    return <>{children}</>;
}
