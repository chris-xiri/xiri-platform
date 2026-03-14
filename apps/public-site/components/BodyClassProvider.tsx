'use client';

import { usePathname } from 'next/navigation';

/**
 * Dynamic body class wrapper — removes the navbar padding-top
 * on NFC pages where the navigation is hidden.
 */
export function BodyClassProvider({
    children,
    className,
}: {
    children: React.ReactNode;
    className: string;
}) {
    const pathname = usePathname();
    const isNfcPage = pathname.startsWith('/s/') || pathname.startsWith('/z/') || pathname.startsWith('/c/') || pathname.startsWith('/onboarding/');

    return (
        <body
            className={className}
            style={isNfcPage ? { paddingTop: 0 } : undefined}
        >
            {children}
        </body>
    );
}
