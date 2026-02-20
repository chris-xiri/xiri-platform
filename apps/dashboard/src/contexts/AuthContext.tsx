'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export type UserRole = 'admin' | 'recruiter' | 'sales' | 'sales_exec' | 'sales_mgr' | 'fsm' | 'night_manager' | 'accounting';

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    roles: UserRole[];
    createdAt: Date;
    updatedAt: Date;
    lastLogin: Date;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    hasRole: (role: UserRole) => boolean;
    hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Smart redirect based on role
    const redirectByRole = (roles: UserRole[]) => {
        if (roles.includes('admin')) {
            router.push('/'); // Admin sees everything
        } else if (roles.includes('fsm')) {
            router.push('/operations/work-orders');
        } else if (roles.includes('night_manager')) {
            router.push('/operations/audits');
        } else if (roles.includes('recruiter')) {
            router.push('/supply/recruitment');
        } else if (roles.includes('sales') || roles.includes('sales_exec') || roles.includes('sales_mgr')) {
            router.push('/sales/dashboard');
        } else if (roles.includes('accounting')) {
            router.push('/accounting/invoices');
        } else {
            router.push('/');
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
                    createdAt: data.createdAt?.toDate(),
                    updatedAt: data.updatedAt?.toDate(),
                    lastLogin: data.lastLogin?.toDate(),
                };
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
        return null;
    };

    // Sign in and redirect
    const signIn = async (email: string, password: string) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userProfile = await fetchUserProfile(userCredential.user.uid);

        if (userProfile) {
            // Update last login
            await updateDoc(doc(db, 'users', userCredential.user.uid), {
                lastLogin: serverTimestamp(),
            });

            setProfile(userProfile);
            redirectByRole(userProfile.roles);
        } else {
            throw new Error('User profile not found');
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        router.push('/login');
    };

    const hasRole = (role: UserRole): boolean => {
        return profile?.roles.includes(role) ?? false;
    };

    const hasAnyRole = (roles: UserRole[]): boolean => {
        return roles.some(role => profile?.roles.includes(role)) ?? false;
    };

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            if (firebaseUser) {
                const userProfile = await fetchUserProfile(firebaseUser.uid);
                setProfile(userProfile);
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, hasRole, hasAnyRole }}>
            {!loading && children}
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
