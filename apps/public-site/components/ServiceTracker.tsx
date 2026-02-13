'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/tracking';

interface ServiceTrackerProps {
    service: string;
    location: string;
}

export function ServiceTracker({ service, location }: ServiceTrackerProps) {
    useEffect(() => {
        trackEvent('service_view', {
            service_slug: service,
            location_slug: location,
            timestamp: new Date().toISOString(),
        });
    }, [service, location]);

    return null;
}
