'use client';

import { useEffect } from 'react';
import { initTracking } from '@/lib/tracking';

export default function TrackingProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        // Initialize tracking on mount
        initTracking();
    }, []);

    return <>{children}</>;
}
