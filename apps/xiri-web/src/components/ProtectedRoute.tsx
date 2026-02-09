'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Resource, canAccess } from '@/lib/accessControl';

interface ProtectedRouteProps {
    children: React.ReactNode;
    resource: Resource;
    fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, resource, fallback }: ProtectedRouteProps) {
    const { profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !profile) {
            router.push('/login');
        } else if (!loading && profile && !canAccess(resource, profile.roles)) {
            router.push('/unauthorized');
        }
    }, [profile, loading, resource, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!profile || !canAccess(resource, profile.roles)) {
        return fallback || null;
    }

    return <>{children}</>;
}
