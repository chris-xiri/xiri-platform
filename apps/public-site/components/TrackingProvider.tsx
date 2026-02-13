'use client';

import { useEffect } from 'react';
import { initTracking } from '@/lib/tracking';
import { TrackingDebugOverlay } from '@/components/TrackingDebugOverlay';

export default function TrackingProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        // Initialize tracking on mount
        initTracking();
    }, []);

    return (
        <>
            {children}
            <TrackingDebugOverlay />
        </>
    );
}
