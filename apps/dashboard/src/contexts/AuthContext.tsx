'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onIdTokenChanged,
    browserLocalPersistence,
    setPersistence,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, enableNetwork } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AUTH_REQUIRED_EVENT, isAuthRelatedError, isOfflineLikeError, reportAuthRequired } from '@/lib/authRecovery';

export type UserRole = 'admin' | 'recruiter' | 'sales' | 'sales_exec' | 'sales_mgr' | 'fsm' | 'night_manager' | 'accounting';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    roles: UserRole[];
    companyId?: string;
    googleUserId?: string;     // Numeric Google User ID for Chat @mentions
    createdAt: Date;
    updatedAt: Date;
    lastLogin: Date;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    hasRole: (role: UserRole) => boolean;
    hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Google Auth provider — restrict to xiri.ai domain
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    hd: 'xiri.ai',              // Only allow @xiri.ai accounts
    prompt: 'select_account',   // Always show account picker
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionRecoveryOpen, setSessionRecoveryOpen] = useState(false);
    const [sessionRecoveryBusy, setSessionRecoveryBusy] = useState(false);
    const router = useRouter();

    // Smart redirect — land each role on their highest-use page
    const redirectByRole = (roles: UserRole[]) => {
        if (roles.includes('admin')) {
            router.push('/sales/crm');
        } else if (roles.includes('sales') || roles.includes('sales_exec') || roles.includes('sales_mgr')) {
            router.push('/sales/crm');
        } else if (roles.includes('fsm')) {
            router.push('/sales/crm');
        } else if (roles.includes('recruiter')) {
            router.push('/supply/dashboard');
        } else if (roles.includes('night_manager')) {
            router.push('/operations/audits');
        } else if (roles.includes('accounting')) {
            router.push('/accounting/invoices');
        } else {
            router.push('/sales/crm');
        }
    };

    // Fetch user profile from Firestore
    const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                return {
                    uid: data.uid,
                    email: data.email,
                    displayName: data.displayName,
                    roles: data.roles,
                    companyId: data.companyId,
                    googleUserId: data.googleUserId,
                    createdAt: data.createdAt?.toDate(),
                    updatedAt: data.updatedAt?.toDate(),
                    lastLogin: data.lastLogin?.toDate(),
                };
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            if (isAuthRelatedError(error)) {
                reportAuthRequired('Your session is no longer authorized.');
            }
        }
        return null;
    };

    /**
     * Extract and store the Google numeric User ID from provider data.
     * This ID is used for @mentions in Google Chat.
     */
    const storeGoogleUserId = async (firebaseUser: User) => {
        const googleProvider = firebaseUser.providerData.find(p => p.providerId === 'google.com');
        if (googleProvider?.uid) {
            try {
                await updateDoc(doc(db, 'users', firebaseUser.uid), {
                    googleUserId: googleProvider.uid,
                    lastLogin: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            } catch (err) {
                console.error('Error storing googleUserId:', err);
            }
        }
    };

    // Sign in with email/password (fallback)
    const signIn = async (email: string, password: string) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userProfile = await fetchUserProfile(userCredential.user.uid);

        if (userProfile) {
            await updateDoc(doc(db, 'users', userCredential.user.uid), {
                lastLogin: serverTimestamp(),
            });
            setProfile(userProfile);
            redirectByRole(userProfile.roles);
        } else {
            throw new Error('User profile not found');
        }
    };

    // Sign in with Google (primary method)
    const signInWithGoogleHandler = async () => {
        const userCredential = await signInWithPopup(auth, googleProvider);
        const firebaseUser = userCredential.user;

        // Enforce @xiri.ai domain
        if (firebaseUser.email && !firebaseUser.email.endsWith('@xiri.ai')) {
            await firebaseSignOut(auth);
            throw new Error('Only @xiri.ai accounts are allowed.');
        }

        // Check if user doc exists for this Firebase UID
        let userProfile = await fetchUserProfile(firebaseUser.uid);
        const googleProv = firebaseUser.providerData.find(p => p.providerId === 'google.com');

        if (!userProfile) {
            // No doc for this UID — check if there's a legacy password-based user
            // with the same email whose roles we should migrate
            let migratedRoles: UserRole[] = [];
            let migratedData: Record<string, any> = {};

            if (firebaseUser.email) {
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const usersQuery = query(
                    collection(db, 'users'),
                    where('email', '==', firebaseUser.email)
                );
                const snapshot = await getDocs(usersQuery);
                if (!snapshot.empty) {
                    const legacyDoc = snapshot.docs[0];
                    const legacyData = legacyDoc.data();
                    migratedRoles = legacyData.roles || [];
                    migratedData = {
                        companyId: legacyData.companyId || null,
                    };
                    console.log(`🔄 Migrating roles from legacy user ${legacyDoc.id} → ${firebaseUser.uid}`);
                }
            }

            await setDoc(doc(db, 'users', firebaseUser.uid), {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                roles: migratedRoles,
                googleUserId: googleProv?.uid || null,
                ...migratedData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
            });

            userProfile = await fetchUserProfile(firebaseUser.uid);
        } else {
            // Existing user — store Google UID and update login timestamp
            await storeGoogleUserId(firebaseUser);
        }

        if (userProfile) {
            setProfile(userProfile);
            if (userProfile.roles.length === 0) {
                router.push('/unauthorized');
            } else {
                redirectByRole(userProfile.roles);
            }
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setSessionRecoveryOpen(false);
        router.push('/login');
    };

    const refreshSession = async () => {
        if (!auth.currentUser) {
            router.push('/login');
            return;
        }

        setSessionRecoveryBusy(true);
        try {
            await auth.currentUser.getIdToken(true);
            const userProfile = await fetchUserProfile(auth.currentUser.uid);
            setUser(auth.currentUser);
            setProfile(userProfile);
            setSessionRecoveryOpen(false);
        } catch (error) {
            console.error('[Auth] Session refresh failed:', error);
            await firebaseSignOut(auth).catch(() => undefined);
            setUser(null);
            setProfile(null);
            setSessionRecoveryOpen(false);
            router.push('/login');
        } finally {
            setSessionRecoveryBusy(false);
        }
    };

    const hasRole = (role: UserRole): boolean => {
        return profile?.roles.includes(role) ?? false;
    };

    const hasAnyRole = (roles: UserRole[]): boolean => {
        return roles.some(role => profile?.roles.includes(role)) ?? false;
    };

    // Listen to auth state changes
    useEffect(() => {
        let unsubscribeAuth: (() => void) | undefined;

        const initAuth = async () => {
            try {
                await setPersistence(auth, browserLocalPersistence);
            } catch (error) {
                console.error('[Auth] Failed to set persistence:', error);
            }

            unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
                setUser(firebaseUser);

                if (firebaseUser) {
                    const userProfile = await fetchUserProfile(firebaseUser.uid);
                    setProfile(userProfile);
                } else {
                    setProfile(null);
                    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                        router.push('/login');
                    }
                }

                setLoading(false);
            });
        };

        void initAuth();

        // Proactive token refresh every 30 minutes to prevent the 1-hour
        // ID token from silently expiring while the user is working.
        const tokenRefreshInterval = setInterval(async () => {
            const currentUser = auth.currentUser;
            if (currentUser) {
                try {
                    await currentUser.getIdToken(true); // force refresh
                } catch (err) {
                    console.warn('[Auth] Token refresh failed:', err);
                }
            }
        }, 30 * 60 * 1000); // 30 min

        // Also refresh when the tab regains focus (user comes back after break)
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && auth.currentUser) {
                try {
                    await auth.currentUser.getIdToken(true);
                } catch (err) {
                    console.warn('[Auth] Visibility token refresh failed:', err);
                    if (isAuthRelatedError(err)) {
                        setSessionRecoveryOpen(true);
                    }
                }
            }
        };
        const handleWindowFocus = async () => {
            try {
                await enableNetwork(db);
            } catch (err) {
                if (!isOfflineLikeError(err)) {
                    console.warn('[Auth] Firestore network recovery failed on focus:', err);
                }
            }
            if (!auth.currentUser) return;
            try {
                await auth.currentUser.getIdToken(true);
            } catch (err) {
                console.warn('[Auth] Focus token refresh failed:', err);
                if (isAuthRelatedError(err)) {
                    setSessionRecoveryOpen(true);
                }
            }
        };
        const handleBrowserOnline = async () => {
            try {
                await enableNetwork(db);
            } catch (err) {
                if (!isOfflineLikeError(err)) {
                    console.warn('[Auth] Firestore network recovery failed online:', err);
                }
            }
            if (!auth.currentUser) return;
            try {
                await auth.currentUser.getIdToken(true);
            } catch (err) {
                console.warn('[Auth] Online token refresh failed:', err);
            }
        };
        const handleAuthRequired = () => {
            setSessionRecoveryOpen(true);
        };
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            if (isAuthRelatedError(event.reason)) {
                reportAuthRequired('A request was rejected because your session is no longer authorized.');
            }
        };
        const handleGlobalError = (event: ErrorEvent) => {
            if (isAuthRelatedError(event.error || event.message)) {
                reportAuthRequired('A request failed because your session is no longer authorized.');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        window.addEventListener('error', handleGlobalError);

        return () => {
            unsubscribeAuth?.();
            clearInterval(tokenRefreshInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('online', handleBrowserOnline);
            window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            window.removeEventListener('error', handleGlobalError);
        };
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithGoogle: signInWithGoogleHandler, signOut, hasRole, hasAnyRole }}>
            {!loading && children}
            <AlertDialog open={sessionRecoveryOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Session needs to be refreshed</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your dashboard session is no longer authorized. Refresh the session to continue working. If refresh fails, go back to login.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => router.push('/login')}>
                            Go to Login
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={refreshSession} disabled={sessionRecoveryBusy}>
                            {sessionRecoveryBusy ? 'Refreshing…' : 'Refresh Session'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
