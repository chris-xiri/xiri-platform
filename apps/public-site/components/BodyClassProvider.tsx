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
    const isContractorPage = pathname.startsWith('/contractors');
    const isCalculatorPage = pathname.startsWith('/calculator');

    // NFC pages: no nav at all → 0 padding
    // Contractor/calculator pages: no trust bar → reduced padding (112 - 36 = 76px)
    const dynamicStyle = isNfcPage
        ? { paddingTop: 0 }
        : (isContractorPage || isCalculatorPage)
            ? { paddingTop: '76px' }
            : undefined;

    return (
        <body
            className={className}
            style={dynamicStyle}
        >
            {children}
        </body>
    );
}
