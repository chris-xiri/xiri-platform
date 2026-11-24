'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getLastRoute } from '@/lib/persistence';

export default function HomePage() {
    const router = useRouter();
    const { profile, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.replace('/login');
                return;
            }

            // Restore the user's last visited module when reopening the PWA
            const lastRoute = getLastRoute();
            if (lastRoute) {
                router.replace(lastRoute);
                return;
            }

            if (profile.roles.includes('admin') || profile.roles.includes('recruiter')) {
                router.replace('/supply/dashboard');
            } else if (profile.roles.includes('sales')) {
                router.replace('/sales/crm');
            } else {
                router.replace('/sales/crm');
            }
        }
    }, [profile, loading, router]);

    return (
        <div className="flex min-h-dvh items-center justify-center bg-background">
            <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-sm text-muted-foreground">Loading XIRI...</p>
            </div>
        </div>
    );
}
