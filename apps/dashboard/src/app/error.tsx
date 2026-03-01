'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from 'lucide-react';

// Errors that indicate a broken session / logged-out state
const AUTH_ERROR_PATTERNS = [
    "before initialization",   // "Cannot access 'em' before initialization" (Firebase SDK race)
    "auth/network-request-failed",
    "auth/user-token-expired",
    "auth/requires-recent-login",
    "permission-denied",
    "PERMISSION_DENIED",
    "Missing or insufficient permissions",
    "auth/invalid-user-token",
];

function isAuthRelatedError(error: Error): boolean {
    const msg = error.message || '';
    return AUTH_ERROR_PATTERNS.some(pattern => msg.includes(pattern));
}

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();
    const isAuthError = isAuthRelatedError(error);

    useEffect(() => {
        console.error('[ErrorBoundary]', error);
    }, [error]);

    const handleGoToLogin = () => {
        // Clear any stale auth state
        if (typeof window !== 'undefined') {
            // Clear Firebase auth persistence
            try {
                const keys = Object.keys(localStorage).filter(k =>
                    k.startsWith('firebase:') || k.includes('firebaseui')
                );
                keys.forEach(k => localStorage.removeItem(k));
            } catch { /* ignore */ }
            // Hard redirect — router.push doesn't work inside error boundaries
            window.location.href = '/login';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4 px-4">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mb-2">
                <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold">
                {isAuthError ? 'Session Expired' : 'Something went wrong'}
            </h2>
            <p className="text-muted-foreground text-center max-w-md text-sm">
                {isAuthError
                    ? 'Your session has expired or was interrupted. Please log in again to continue.'
                    : error.message
                }
            </p>
            <div className="flex gap-3 pt-2">
                {isAuthError ? (
                    <Button onClick={handleGoToLogin} className="gap-2">
                        <LogOut className="w-4 h-4" /> Go to Login
                    </Button>
                ) : (
                    <>
                        <Button variant="outline" onClick={handleGoToLogin} className="gap-2">
                            <LogOut className="w-4 h-4" /> Go to Login
                        </Button>
                        <Button onClick={() => reset()} className="gap-2">
                            <RefreshCw className="w-4 h-4" /> Try Again
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
