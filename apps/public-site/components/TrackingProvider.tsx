'use client';

import { useEffect, useState } from 'react';
import { initTracking } from '@/lib/tracking';
import { TrackingDebugOverlay } from '@/components/TrackingDebugOverlay';

export default function TrackingProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [showDebug, setShowDebug] = useState(false);

    useEffect(() => {
        initTracking();
        if (
            process.env.NODE_ENV === 'development' ||
            (typeof window !== 'undefined' && window.location.search.includes('debug_tracking=1'))
        ) {
            setShowDebug(true);
        }
    }, []);

    return (
        <>
            {children}
            {showDebug && <TrackingDebugOverlay />}
        </>
    );
}
