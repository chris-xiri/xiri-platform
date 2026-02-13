'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
    const router = useRouter();
    const { profile, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.push('/login');
            } else if (profile.roles.includes('admin')) {
                router.push('/supply/recruitment'); // Admin default view
            } else if (profile.roles.includes('recruiter')) {
                router.push('/supply/recruitment');
            } else if (profile.roles.includes('sales')) {
                router.push('/sales/dashboard');
            }
        }
    }, [profile, loading, router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Redirecting...</p>
            </div>
        </div>
    );
}
