'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { initTracking, recordPageVisit, captureFirstTouchAttribution } from '@/lib/tracking';
import { TrackingDebugOverlay } from '@/components/TrackingDebugOverlay';

export default function TrackingProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [showDebug, setShowDebug] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        initTracking();
        if (
            process.env.NODE_ENV === 'development' ||
            (typeof window !== 'undefined' && window.location.search.includes('debug_tracking=1'))
        ) {
            setShowDebug(true);
        }
    }, []);

    useEffect(() => {
        if (!pathname) return;
        recordPageVisit(pathname);
        // Refresh last-touch if the visitor navigated in with fresh campaign params
        captureFirstTouchAttribution();
    }, [pathname]);

    return (
        <>
            {children}
            {showDebug && <TrackingDebugOverlay />}
        </>
    );
}
