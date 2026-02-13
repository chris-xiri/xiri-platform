'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UnauthorizedPage() {
    const { profile, signOut } = useAuth();
    const router = useRouter();

    const handleGoBack = () => {
        if (profile?.roles.includes('admin')) {
            router.push('/');
        } else if (profile?.roles.includes('recruiter')) {
            router.push('/supply/recruitment');
        } else if (profile?.roles.includes('sales')) {
            router.push('/sales/dashboard');
        } else {
            router.push('/login');
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <ShieldAlert className="h-16 w-16 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl">Access Denied</CardTitle>
                    <CardDescription>
                        You don't have permission to access this page.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                        Your current role: <strong>{profile?.roles.join(', ')}</strong>
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={handleGoBack} className="flex-1">
                            Go to Dashboard
                        </Button>
                        <Button onClick={() => signOut()} variant="outline" className="flex-1">
                            Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
